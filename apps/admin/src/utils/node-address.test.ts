import { expect, it } from "vitest";
import { formatNodeEndpoint, nodeAddressKind } from "./node-address";

it.each([
  ["192.0.2.9", "ipv4"],
  ["2001:db8::9", "ipv6"],
  ["[::ffff:192.0.2.9]", "ipv6"],
  ["edge.example.com", "hostname"],
  ["例子.测试", "hostname"],
  ["300.0.0.1", undefined],
  ["https://edge.example.com", undefined],
  ["", undefined],
])("classifies %s using its stored address", (address, kind) => {
  expect(nodeAddressKind(address)).toBe(kind);
});

it("brackets IPv6 exactly once when displaying a port", () => {
  expect(formatNodeEndpoint("2001:db8::9", 443)).toBe("[2001:db8::9]:443");
  expect(formatNodeEndpoint("[2001:db8::9]", 443)).toBe("[2001:db8::9]:443");
  expect(formatNodeEndpoint("edge.example.com", 443)).toBe(
    "edge.example.com:443"
  );
  expect(formatNodeEndpoint("2001:db8::9", 0)).toBe("2001:db8::9");
});
