import React from "react";
import routeSkeletonModule from "../src/archive/route-skeletons";
import routeUtils from "../src/archive/route-utils";

const { ArchiveRoutePage, buildRouteMetadata, getLandingRouteData } = routeSkeletonModule;
const { stripRetiredOverlayParams } = routeUtils;

export async function generateMetadata({ searchParams }) {
  const params = stripRetiredOverlayParams((await searchParams) ?? {});
  const data = await getLandingRouteData({ searchParams: Object.fromEntries(params) });

  return buildRouteMetadata(data);
}

export default async function ArchivePageRoute({ searchParams }) {
  const params = stripRetiredOverlayParams((await searchParams) ?? {});
  const data = await getLandingRouteData({ searchParams: Object.fromEntries(params) });

  return React.createElement(ArchiveRoutePage, { data });
}
