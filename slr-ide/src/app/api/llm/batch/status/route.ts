import { NextResponse } from 'next/server';

export async function GET() {
  // Batch polling is deprecated in the new Gemini Flex-pacing architecture.
  // Return success immediately to maintain backward-compatibility with UI.
  return NextResponse.json({
    success: true,
    logs: [{ message: "Flex-pacing active. Cloud batch polling disabled." }],
    stderr: ""
  });
}
