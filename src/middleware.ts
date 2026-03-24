import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isAuthorized = (request: NextRequest): boolean => {
  const user = process.env.ADMIN_BASIC_AUTH_USER;
  const pass = process.env.ADMIN_BASIC_AUTH_PASS;
  if (!user || !pass) return true;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;

  const encoded = auth.replace("Basic ", "");
  const decoded = atob(encoded);
  const [inputUser, inputPass] = decoded.split(":");
  return inputUser === user && inputPass === pass;
};

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!isAuthorized(request)) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin Area"'
        }
      });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
