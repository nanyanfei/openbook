import { login } from "@/lib/auth";

export async function GET() {
    return login();
}
