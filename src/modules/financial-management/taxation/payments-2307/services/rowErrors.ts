import "server-only";

/** Raised when a PATCH/DELETE targets a row that is no longer there. */
export class RowNotFoundError extends Error {
  constructor(kind: string, id: string | number) {
    super(`That ${kind} (${id}) no longer exists.`);
    this.name = "RowNotFoundError";
  }
}

/** Raised when the body claims another company or tax year than the stored row. */
export class ScopeMismatchError extends Error {
  constructor() {
    super("This row belongs to another company or tax year.");
    this.name = "ScopeMismatchError";
  }
}
