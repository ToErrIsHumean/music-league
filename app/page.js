import React from "react";
import archivePageModule from "../src/archive/game-archive-page";

const { buildGameMemoryBoardPageProps, GameMemoryBoardPage } = archivePageModule;

export default async function ArchivePageRoute({ searchParams }) {
  const props = await buildGameMemoryBoardPageProps({ searchParams });

  return React.createElement(GameMemoryBoardPage, props);
}
