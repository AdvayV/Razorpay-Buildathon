import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const envPath = resolve(projectRoot, ".env.local");
const executablePath = resolve(projectRoot, ".tools", "razorpay", "razorpay.exe");

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

if (!existsSync(executablePath)) {
  console.error("Razorpay CLI is not installed in .tools/razorpay.");
  process.exit(1);
}

const forwardedArgs = process.argv.slice(2);
const allowWriteIndex = forwardedArgs.indexOf("--allow-write");
const allowWrite = allowWriteIndex !== -1;

if (allowWrite) {
  forwardedArgs.splice(allowWriteIndex, 1);
}

const informationalCommand =
  forwardedArgs.length === 0 ||
  forwardedArgs.includes("--help") ||
  forwardedArgs.includes("-h") ||
  forwardedArgs.includes("--version") ||
  forwardedArgs.includes("-v") ||
  ["help", "completion"].includes(forwardedArgs[0]);

const readOnlyOperations = new Set(["list", "fetch", "payments", "card"]);
const readOnlyCommand = informationalCommand || readOnlyOperations.has(forwardedArgs[1]);

if (!readOnlyCommand && !allowWrite) {
  console.error(
    "Blocked a possible write operation. Review it, then repeat with --allow-write.",
  );
  process.exit(2);
}

if (!informationalCommand) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error(
      "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env.local.",
    );
    process.exit(1);
  }

  if (!keyId.startsWith("rzp_test_")) {
    console.error("Blocked: this project CLI accepts Razorpay test-mode keys only.");
    process.exit(2);
  }
}

const result = spawnSync(executablePath, forwardedArgs, {
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to start Razorpay CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
