import React from "react";
import routeSkeletonModule from "../../../src/archive/route-skeletons";

const { ArchiveRoutePage, buildRouteMetadata, getSongRouteData } = routeSkeletonModule;

export async function generateMetadata({ params }) {
  const resolvedParams = (await params) ?? {};
  const data = await getSongRouteData(resolvedParams.songId);

  return buildRouteMetadata(data);
}

export default async function SongRoute({ params }) {
  const resolvedParams = (await params) ?? {};
  const data = await getSongRouteData(resolvedParams.songId);

  return React.createElement(ArchiveRoutePage, { data });
}
