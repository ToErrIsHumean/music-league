import React from "react";
import routeSkeletonModule from "../../../src/archive/route-skeletons";

const { ArchiveRoutePage, buildRouteMetadata, getGameRouteData } = routeSkeletonModule;

export async function generateMetadata({ params }) {
  const resolvedParams = (await params) ?? {};
  const data = await getGameRouteData(resolvedParams.gameId);

  return buildRouteMetadata(data);
}

export default async function GameRoute({ params }) {
  const resolvedParams = (await params) ?? {};
  const data = await getGameRouteData(resolvedParams.gameId);

  return React.createElement(ArchiveRoutePage, { data });
}
