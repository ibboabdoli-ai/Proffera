import "pg";

declare module "pg" {
  interface Client {
    /** PostgreSQL backend PID exposed by node-postgres after connect(). */
    processID: number;
  }
}
