import React from "react";
import routeSkeletonModule from "../../../src/archive/route-skeletons";
import routeUtils from "../../../src/archive/route-utils";

const { ArchiveRoutePage, buildRouteMetadata, getPlayerRouteData } = routeSkeletonModule;
const { stripRetiredOverlayParams } = routeUtils;

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = (await params) ?? {};
  const query = stripRetiredOverlayParams((await searchParams) ?? {});
  const data = await getPlayerRouteData(resolvedParams.playerId, {
    searchParams: Object.fromEntries(query),
  });

  return buildRouteMetadata(data);
}

export default async function PlayerRoute({ params, searchParams }) {
  const resolvedParams = (await params) ?? {};
  const query = stripRetiredOverlayParams((await searchParams) ?? {});
  const data = await getPlayerRouteData(resolvedParams.playerId, {
    searchParams: Object.fromEntries(query),
  });

  return React.createElement(ArchiveRoutePage, { data });
}
