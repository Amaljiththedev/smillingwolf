import { getSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";
import { WordPressError, uploadMedia } from "@/lib/wordpress";

/*
  Image and document uploads from the builder. The browser sends the file
  here; this server checks it and passes it on to the WordPress media
  library with the app password, so the browser never holds a WordPress login.

  Only images (for blocks) and PDFs (for the documents block) are accepted,
  checked by their first bytes as well as by the type the browser claims.
*/

const KINDS = {
  "image/jpeg": { ext: "jpg", max: 8_000_000, magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: "png", max: 8_000_000, magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/gif": { ext: "gif", max: 8_000_000, magic: [[0x47, 0x49, 0x46, 0x38]] },
  "image/webp": { ext: "webp", max: 8_000_000, magic: [[0x52, 0x49, 0x46, 0x46]] },
  "application/pdf": { ext: "pdf", max: 20_000_000, magic: [[0x25, 0x50, 0x44, 0x46]] },
} as const;

type Kind = keyof typeof KINDS;

function isKind(value: string): value is Kind {
  return value in KINDS;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/** A plain ASCII filename WordPress will accept, keeping the original name readable. */
function cleanName(name: string, ext: string): string {
  const stem = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || "upload"}.${ext}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return Response.json({ error: "Log in first." }, { status: 401 });

  const { id } = await params;
  const site = getSite(id);
  if (!site) return Response.json({ error: "Unknown site." }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the file as form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
  if (!isKind(file.type)) {
    return Response.json({ error: "Use a JPG, PNG, WebP or GIF image, or a PDF." }, { status: 415 });
  }

  const kind = KINDS[file.type];
  if (file.size > kind.max) {
    return Response.json({ error: `That file is too big. The limit is ${kind.max / 1_000_000} MB.` }, { status: 413 });
  }

  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes.slice(0, 12));
  const real = kind.magic.some((signature) => startsWith(head, signature)) && (file.type !== "image/webp" || startsWith(head.slice(8), [0x57, 0x45, 0x42, 0x50]));
  if (!real) return Response.json({ error: "That file does not look like the type it says it is." }, { status: 415 });

  try {
    const uploaded = await uploadMedia(site.wordpress, { name: cleanName(file.name, kind.ext), type: file.type, bytes });
    return Response.json({ url: uploaded.url, size: uploaded.size, name: file.name });
  } catch (error) {
    console.error("[media upload]", error);
    const status = error instanceof WordPressError ? error.status : 500;
    const message = error instanceof WordPressError ? error.message : "The upload failed.";
    return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
