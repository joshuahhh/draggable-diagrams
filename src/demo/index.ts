import { ComponentType } from "react";

export type DemoOptions = {
  tags?: string[];
};

export type DemoInfo = {
  Component: ComponentType;
} & DemoOptions;

const DEMO_SYMBOL = Symbol("demo");

export type DemoMarked = DemoInfo & { [DEMO_SYMBOL]: true };

export function demo(
  Component: ComponentType,
  options?: DemoOptions,
): DemoMarked {
  return { Component, ...options, [DEMO_SYMBOL]: true };
}

export function isDemo(value: unknown): value is DemoMarked {
  return typeof value === "object" && value !== null && DEMO_SYMBOL in value;
}
