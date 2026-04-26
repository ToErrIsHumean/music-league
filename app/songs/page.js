import React from "react";
import routeSkeletonModule from "../../src/archive/route-skeletons";
import routeUtils from "../../src/archive/route-utils";

const { ArchiveRoutePage, buildRouteMetadata, getSongsRouteData } = routeSkeletonModule;
const { stripRetiredOverlayParams } = routeUtils;

export async function generateMetadata({ searchParams }) {
  const params = stripRetiredOverlayParams((await searchParams) ?? {});
  const data = await getSongsRouteData({ searchParams: Object.fromEntries(params) });

  return buildRouteMetadata(data);
}

export default async function SongsRoute({ searchParams }) {
  const params = stripRetiredOverlayParams((await searchParams) ?? {});
  const data = await getSongsRouteData({ searchParams: Object.fromEntries(params) });

  return React.createElement(ArchiveRoutePage, { data });
}
