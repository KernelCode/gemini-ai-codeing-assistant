import * as vscode from "vscode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

const MODEL_NAME = "gemini-pro";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("extension.performAction", performAction);
  let storeApiKey = vscode.commands.registerCommand("gemini-ai-codeing-assistant.storeApiKey", async () => {
    vscode.window
      .showInputBox({
        prompt: "Store Gemini Pro Api Key",
        password: true,
      })
      .then((apiKey) => {
        if (apiKey) {
          vscode.workspace.getConfiguration("geminiApiKey").update("key", apiKey, true);
          vscode.window.showInformationMessage("Gemini Api Key Saved!");
        }
      });
  });

  context.subscriptions.push(storeApiKey, disposable);
}

function addLineNumbers(text: string): string {
  const lines = text.split("\n");
  const numberedLines = lines.map((line, index) => `${index + 1}: ${line}`);
  return numberedLines.join("\n");
}

function performAction() {
  // Get the active text editor
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    // Show loading notification
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating AI code...",
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ increment: 0 });

          const language = editor.document.languageId;
          const fileTextWithLineNumbers = addLineNumbers(editor.document.getText());
          const currentLineText = editor.document.lineAt(editor.selection.active.line).text.trim();
          const lineNumber = editor.selection.active.line + 1;

          // Generate the code
          const generatedCode = await generateCode(fileTextWithLineNumbers, lineNumber, currentLineText, language);

          // Insert the generated code at the current cursor position
          editor.insertSnippet(new vscode.SnippetString("\n" + generatedCode), editor.selection.active);
          vscode.window.showInformationMessage("AI Code Generated!");
        } catch (error: any) {
          vscode.window.showErrorMessage("Error generating code: " + error?.message);
        }
      }
    );
  }
}

async function generateCode(
  fileTextWithLineNumbers: string,
  lineNumber: number,
  currentLineText: string,
  language: string
): Promise<string> {
  const API_KEY: any = vscode.workspace.getConfiguration("geminiApiKey").get("key");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const packageJsonPath = path.join(workspaceFolder || "", "package.json");

  let projectName = "";
  let projectType = "";

  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);
    projectName = packageJson.name || "";
    projectType = packageJson.dependencies && packageJson.dependencies.react ? "React" : "Node.js";
  } catch (error) {
    console.error("Error reading package.json:", error);
  }

  const prompt = `
  File project with line numbers:
  ${fileTextWithLineNumbers} You are in line ${lineNumber}.
  I want to replace: "${currentLineText}" with actual working code.
  AND DON'T REWRITE THE WHOLE function/class/etc... just the code needed in that scope.
  Giving this information:
    Project Name: "${projectName}"
    Project Type: "${projectType}"
    Project Programming Language: ${language}.
  Do the following exactly: 
    Replace the comment "${currentLineText}" with actual code, just the code without any additional lines, and the code SHOULD NOT be wrapped in code blocks (i.e., \`\`\`).`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text;
}

export function deactivate() {}
