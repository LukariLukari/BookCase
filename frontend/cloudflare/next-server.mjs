// The API handlers only need native responses and a parsed request URL.
// Their existing authentication/authorization and database code stays unchanged.
export const NextResponse = Response;
export class NextRequest extends Request {
  constructor(request, init) {
    super(request, init);
    this.nextUrl = new URL(this.url);
  }
}
