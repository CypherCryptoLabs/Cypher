const BCrypto = require("../src/bcrypto");
const bcrypto = new BCrypto("");
const fs = require("fs");

test("creates private Key", ()=> {
    expect(fs.existsSync("private.pem")).toBe(true);
})

test("create and validate Signature", () => {
    expect(bcrypto.verrifySignature("MEYCIQCCdZOdvdAt3XX5Ki0ep7yIizNtTQsv6hhvHQxB4tBlLAIhALgHxMia9SW0HoXnnTs+hiu2l4xWbf0apuB3yACw+sTz", bcrypto.getPubKey(true), "TEST")).toBe(true);
});

test("get local fingerprint", ()=> {
    expect(bcrypto.getFingerprint()).toBe("30c442f72e92c0ddcd5662ebf399a1e9ea00f8f77fac95b8ac4c4456a2661d47");
});

test("get fingerprint from key string", ()=> {
    expect(bcrypto.getFingerprint(fs.readFileSync("private.pem").toString("utf-8"))).toBe("30c442f72e92c0ddcd5662ebf399a1e9ea00f8f77fac95b8ac4c4456a2661d47");
});

test("hash", ()=> {
    expect(bcrypto.hash("TEST")).toBe("94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2");
})