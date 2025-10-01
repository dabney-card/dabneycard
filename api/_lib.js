import jwt from "jsonwebtoken";

export function verifyJWT(req) {
  let authHeader;
  if (typeof req.headers.get === "function") {
    authHeader = req.headers.get("authorization");
  } else {
    authHeader = req.headers["authorization"] || req.headers["Authorization"];
  }

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  return jwt.verify(token, process.env.JWT_SECRET);
}
