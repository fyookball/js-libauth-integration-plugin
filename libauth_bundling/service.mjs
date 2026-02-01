import * as libauth from "@bitauth/libauth";

/**
 * Minimal JSON-RPC bridge for libauth.
 *
 * IN -- from python to JS:
 * from python side, bytes must be marked as "hexbytes", bigint must be marked as "bigint".
 * (maps to Uint8array and Bigint)
 *
 * OUT -- from JS to python:
 * outgoing bytes (Uint8array) get marked as "hexbytes" and bigint is marked as "bigint".
 * 
 * (These are JSON markers).
 */
 

/** You must explicitly declare methods from libauth you want. */
const LIBAUTH_ALLOWLIST = new Set([
  "hexToBin",
  "binToHex",
  "privateKeyToP2pkhCashAddress",
  "publicKeyToP2pkhCashAddress",
  "decodeCashAddress", 
  "decodeTransactionCommon",
  "encodeTransactionCommon",
  "compileCashAssembly",
  "secp256k1.derivePublicKeyCompressed",  // dotted paths allowed.
  "secp256k1.derivePublicKeyUncompressed",
]);

function writeLine(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function writeOk(id, result) {
  writeLine({ id, ok: true, result });
}

function writeErr(id, message, details) {
  writeLine({ id, ok: false, error: { message, details } });
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Uint8Array);
}

/** IN: Convert explicit transport markers recursively. */
function reviveMarkers(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(reviveMarkers);

  if (isPlainObject(value)) {
    const keys = Object.keys(value);

    if (keys.length === 1 && keys[0] === "hexbytes") {
      const hex = value.hexbytes;
      if (typeof hex !== "string") throw new Error("hexbytes marker must be a string");
      return libauth.hexToBin(hex);
    }

    if (keys.length === 1 && keys[0] === "bigint") {
      const dec = value.bigint;
      if (typeof dec !== "string") throw new Error("bigint marker must be a string (decimal)");
      if (!/^-?\d+$/.test(dec)) throw new Error("bigint marker must be a base-10 integer string");
      return BigInt(dec);
    }

    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveMarkers(v);
    return out;
  }

  return value;
}

/** OUT: Make libauth return values JSON-safe by encoding non-JSON types. */
function toJsonSafe(value) {
  if (value === null || value === undefined) return value;

  if (value instanceof Uint8Array) return { hexbytes: libauth.binToHex(value) };
  if (typeof value === "bigint") return { bigint: value.toString(10) };

  if (Array.isArray(value)) return value.map(toJsonSafe);

  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v);
    return out;
  }

  return value;
}



// helper
function resolveLibauthCallable(path) {
  const parts = path.split(".");
  let cur = libauth;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur;
}


/**
 * The only RPC method:
 * params: { fn: string, args: any[] | any }
 */

async function handle_libauthCall(params) {
  const { fn, args } = params || {};
  if (typeof fn !== "string" || fn.length === 0) throw new Error("fn is required");

  if (!LIBAUTH_ALLOWLIST.has(fn)) {
    throw new Error(`libauth fn not allowed: ${fn}`);
  }

  const target = resolveLibauthCallable(fn);
  if (typeof target !== "function") {
    throw new Error(`libauth export is not a function: ${fn}`);
  }

  const revivedArgs = reviveMarkers(args);
  const raw = Array.isArray(revivedArgs) ? target(...revivedArgs) : target(revivedArgs);
  const awaited = raw && typeof raw.then === "function" ? await raw : raw;
  return toJsonSafe(awaited);
}

 
/* Stdin messaging with framing.  This reads a stream of bytes from stdin,
splits it into newline separated JSON messages, dispatches each
message to the handler and writes a JSON response to stdout. */

 
let buffer = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  buffer += chunk;

  while (true) {
    const nl = buffer.indexOf("\n");
    if (nl === -1) break;

    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      writeErr(null, "Invalid JSON", { line });
      continue;
    }

    const id = Object.prototype.hasOwnProperty.call(msg, "id") ? msg.id : null;

    // The method in this RPC: 
    if (msg.method !== "libauthCall") {
      writeErr(id, "Unknown method", {
        got: msg.method,
        allowed: ["libauthCall"], 
      });
      continue;
    }

    (async () => {
      try {
        const result = await handle_libauthCall(msg.params);
        writeOk(id, result);
      } catch (e) {
        writeErr(id, "Exception", {
          name: e?.name,
          message: e?.message ?? String(e),
          stack: e?.stack,
        });
      }
    })();
  }
});

process.stdin.on("end", () => process.exit(0));

