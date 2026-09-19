/* Corrige um problema real do electron-builder no Windows: ele empacota o
 * 7za.exe e chama `x -snld ...` pra extrair o winCodeSign — mas "-snld" não
 * é reconhecido pela versão do 7-Zip usada aqui (21.07), então ele volta ao
 * comportamento padrão de recriar links simbólicos de verdade, o que falha
 * com "Cannot create symbolic link" em qualquer conta sem o privilégio
 * SeCreateSymbolicLinkPrivilege (a maioria das contas não-admin do Windows).
 *
 * A correção certa seria "-snl-" (desliga symlink de vez) — como não dá
 * pra editar o binário do 7-Zip, troca o 7za.exe por um wrapper que reescreve
 * esse argumento antes de repassar pro 7za de verdade (renomeado). Roda
 * automaticamente depois de `npm install` (ver "postinstall" no package.json)
 * — sem isso, empacotar o instalador quebra de novo a cada instalação limpa.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

if (process.platform !== "win32") process.exit(0);

const ARCHS = ["x64", "ia32", "arm64"];

const WRAPPER_SOURCE = `
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

class Wrapper
{
    static int Main(string[] args)
    {
        string self = System.Reflection.Assembly.GetExecutingAssembly().Location;
        string dir = Path.GetDirectoryName(self);
        string real = Path.Combine(dir, "7za-real.exe");

        var sb = new StringBuilder();
        foreach (var a in args)
        {
            string arg = a == "-snld" ? "-snl-" : a;
            if (sb.Length > 0) sb.Append(' ');
            if (arg.Contains(" "))
                sb.Append('"').Append(arg).Append('"');
            else
                sb.Append(arg);
        }

        var psi = new ProcessStartInfo(real, sb.ToString());
        psi.UseShellExecute = false;
        var p = Process.Start(psi);
        p.WaitForExit();
        return p.ExitCode;
    }
}
`;

function isAlreadyWrapped(exePath) {
  // O wrapper compilado é bem menor (poucos KB) que o 7za.exe real (~1.2MB)
  // — jeito simples de saber se já foi trocado, sem manter estado à parte.
  try {
    return fs.statSync(exePath).size < 200 * 1024;
  } catch {
    return false;
  }
}

function fixArch(arch) {
  const dir = path.join(__dirname, "..", "node_modules", "7zip-bin", "win", arch);
  const exe = path.join(dir, "7za.exe");
  const real = path.join(dir, "7za-real.exe");
  if (!fs.existsSync(exe)) return;
  if (isAlreadyWrapped(exe)) return;

  fs.copyFileSync(exe, real);
  const srcFile = path.join(dir, "_wrapper-src.cs");
  fs.writeFileSync(srcFile, WRAPPER_SOURCE, "utf-8");
  fs.rmSync(exe, { force: true });

  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Add-Type -TypeDefinition (Get-Content -Raw '${srcFile}') -OutputType ConsoleApplication -OutputAssembly '${exe}'`,
      ],
      { stdio: "inherit" }
    );
    console.log(`[fix-7za-symlink] ${arch}: wrapper instalado.`);
  } catch (e) {
    // Sem PowerShell/.NET disponível (raro): desfaz e segue — o build
    // simplesmente vai falhar do jeito antigo se isso não for corrigido,
    // não trava a instalação por causa disso.
    fs.copyFileSync(real, exe);
    console.warn(`[fix-7za-symlink] ${arch}: não deu pra compilar o wrapper (${e.message}) — mantido original.`);
  } finally {
    fs.rmSync(srcFile, { force: true });
  }
}

for (const arch of ARCHS) fixArch(arch);
