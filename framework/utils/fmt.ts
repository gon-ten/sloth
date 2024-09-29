import * as colors from "@std/fmt/colors";

export async function formatFiles({
  entryFiles,
  target,
}: {
  entryFiles: string[];
  target: string;
}) {
  const fmtCmd = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "-q", ...entryFiles],
    stderr: "piped",
    stdout: "null",
  });
  const cp = fmtCmd.spawn();
  const { success, stderr } = await cp.output();
  console.log(
    success
      ? colors.green(`✔️ ${target}: output files formatted correctly.`)
      : colors.red(
          `⨯ ${target} there was an error during file formatting. ${stderr}`
        )
  );
}
