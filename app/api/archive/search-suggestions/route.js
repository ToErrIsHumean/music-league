import searchSuggestionsApi from "../../../../src/archive/search-suggestions-api";

const {
  getArchiveSearchSuggestionsMethodNotAllowedResult,
  getArchiveSearchSuggestionsResult,
} = searchSuggestionsApi;

function jsonResult(result) {
  return Response.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const result = await getArchiveSearchSuggestionsResult({
    q: url.searchParams.get("q") ?? "",
  });

  return jsonResult(result);
}

function methodNotAllowed() {
  return jsonResult(getArchiveSearchSuggestionsMethodNotAllowedResult());
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
