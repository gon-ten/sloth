export async function withTempFile(
  callback: (tempFile: string) => Promise<void>,
) {
  const tempFile = await Deno.makeTempFile();
  try {
    await callback(tempFile);
  } finally {
    await Deno.remove(tempFile).catch(() => null);
  }
}
