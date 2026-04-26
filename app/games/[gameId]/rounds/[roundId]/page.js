import React from "react";
import routeSkeletonModule from "../../../../../src/archive/route-skeletons";

const { ArchiveRoutePage, buildRouteMetadata, getRoundRouteData } = routeSkeletonModule;

export async function generateMetadata({ params }) {
  const resolvedParams = (await params) ?? {};
  const data = await getRoundRouteData(resolvedParams.gameId, resolvedParams.roundId);

  return buildRouteMetadata(data);
}

export default async function RoundRoute({ params }) {
  const resolvedParams = (await params) ?? {};
  const data = await getRoundRouteData(resolvedParams.gameId, resolvedParams.roundId);

  return React.createElement(ArchiveRoutePage, { data });
}
