import { authErrorResponse, authorize } from "@/lib/auth";

// The logged-in user's own public profile. Role and wallet come from the server session.
export async function GET() {
  try {
    const user = await authorize(["creator", "investor", "mule", "organizer"]);
    return Response.json(user);
  } catch (error) {
    return authErrorResponse(error);
  }
}
