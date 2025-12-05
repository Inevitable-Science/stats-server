export function generateDiscordTimestamp(
  date: Date | number,
  style: "t" | "T" | "d" | "D" | "f" | "F" | "R" = "f"
): string {
  const timestamp = Math.floor(
    date instanceof Date ? date.getTime() / 1000 : date / 1000
  );
  return `<t:${timestamp}:${style}>`;
}
