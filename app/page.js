import React from "react";
import archivePageModule from "../src/archive/game-archive-page";

const { buildGameArchivePageProps, GameArchivePage } = archivePageModule;

export default async function ArchivePageRoute({ searchParams }) {
  const props = await buildGameArchivePageProps({ searchParams });

  return React.createElement(GameArchivePage, props);
}
