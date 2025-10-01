import jwt from "jsonwebtoken";

export function verifyJWT(req) {
  // Works for both Node (object) and Edge (Headers) runtimes
  let authHeader;
  if (typeof req.headers.get === "function") {
    // Edge API Route (Web Fetch API style)
    authHeader = req.headers.get("authorization");
  } else {
    // Node.js API Route (Express style object)
    authHeader = req.headers["authorization"] || req.headers["Authorization"];
  }

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  return jwt.verify(token, process.env.JWT_SECRET);
}
