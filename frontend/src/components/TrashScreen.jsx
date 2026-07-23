import React from 'react';
import { hov } from '../lib/ui';

// Extracted from AppShell; renders when V.isTrashView is set.
export default function TrashScreen(V) {
  return (
    (V.isTrashView) ? (<React.Fragment><div style={{"display":"flex","alignItems":"center","gap":"10px","background":"#FFF7ED","border":"1px solid #FED7AA","borderRadius":"11px","padding":"11px 15px"}}><span style={{"fontSize":"12.5px","color":"#9A5B1E","flex":"1"}}>Files are kept for <strong>7 days</strong> on Free — upgrade for 30‑day retention.</span><button onClick={V.emptyTrash} style={{"flex":"0 0 auto","background":"#FFFFFF","border":"1px solid #F3C9C9","color":"#E5484D","borderRadius":"8px","padding":"6px 12px","fontSize":"12px","fontWeight":"600","cursor":"pointer","fontFamily":"'IBM Plex Sans',sans-serif"}}>Empty trash</button></div></React.Fragment>) : null
  );
}
