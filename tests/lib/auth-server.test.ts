import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getSessionUser, hasMinimumRole } from "@/lib/auth-server";
import { makeFakeDb, fakeReq } from "../helpers/fake-admin";

describe("auth-server", () => {
  const verifySessionCookie = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (getAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({ verifySessionCookie });
  });

  describe("getSessionUser", () => {
    it("returns null when there is no session cookie", async () => {
      expect(await getSessionUser(fakeReq())).toBeNull();
      expect(verifySessionCookie).not.toHaveBeenCalled();
    });

    it("returns uid and role from the users collection", async () => {
      verifySessionCookie.mockResolvedValue({ uid: "u1" });
      const { db } = makeFakeDb({ users: [{ id: "u1", role: "manager" }] });
      (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

      const user = await getSessionUser(fakeReq({ session: "cookie" }));
      expect(verifySessionCookie).toHaveBeenCalledWith("cookie", true);
      expect(user).toEqual({ uid: "u1", role: "manager" });
    });

    it("defaults role to viewer when the user doc has none", async () => {
      verifySessionCookie.mockResolvedValue({ uid: "u2" });
      const { db } = makeFakeDb({ users: [] });
      (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue(db);

      expect(await getSessionUser(fakeReq({ session: "c" }))).toEqual({ uid: "u2", role: "viewer" });
    });

    it("returns null when the cookie is invalid", async () => {
      verifySessionCookie.mockRejectedValue(new Error("expired"));
      expect(await getSessionUser(fakeReq({ session: "bad" }))).toBeNull();
    });
  });

  describe("hasMinimumRole", () => {
    it("orders roles viewer < mecanico < operador < manager < admin", () => {
      expect(hasMinimumRole("admin", "manager")).toBe(true);
      expect(hasMinimumRole("manager", "manager")).toBe(true);
      expect(hasMinimumRole("operador", "manager")).toBe(false);
      expect(hasMinimumRole("mecanico", "operador")).toBe(false);
      expect(hasMinimumRole("viewer", "viewer")).toBe(true);
    });
  });
});
