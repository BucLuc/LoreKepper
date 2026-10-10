import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const value = process.env.LORE_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("LORE_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  return Buffer.from(value, "hex");
}
export function encrypt(value: unknown, collection: string, id: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`${collection}:${id}`));
  const content = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    content.toString("base64"),
  ].join(".");
}
export function decrypt(value: string, collection: string, id: string) {
  const [version, iv, tag, content] = value.split(".");
  if (version !== "v1") throw new Error("Unsupported encrypted entry.");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
  );
  cipher.setAAD(Buffer.from(`${collection}:${id}`));
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(content, "base64")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
