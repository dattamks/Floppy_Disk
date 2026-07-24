import React from 'react';
import { hov } from '../lib/ui';

// Extracted from AppShell.
export default function Breadcrumb(V) {
  return (
    (V.isDesktop) ? (<React.Fragment>{' '}{(V.showBreadcrumb) ? (<React.Fragment>{' '}<div style={{"display":"flex","alignItems":"center","gap":"7px"}}>{' '}<button onClick={V.navToAll} style={{"background":"none","border":"none","color":V.crumbRootColor,"fontWeight":"700","cursor":"pointer","padding":"0","fontFamily":"'Space Grotesk',sans-serif","fontSize":"20px"}}>My Files</button>{' '}{(V.breadcrumbCrumbs||[]).map((cr, $index) => (<React.Fragment key={$index}><span style={{"color":"#B4B9C2","fontSize":"18px"}}>/</span><button onClick={cr.onClick} style={{"background":"none","border":"none","color":"#15171C","fontWeight":"700","cursor":"pointer","padding":"0","fontFamily":"'Space Grotesk',sans-serif","fontSize":"20px"}}>{cr.name}</button></React.Fragment>))}{' '}</div>{' '}</React.Fragment>) : null}{' '}{(V.showSectionTitleOnly) ? (<React.Fragment><div style={{"fontWeight":"700","fontSize":"20px","fontFamily":"'Space Grotesk',sans-serif"}}>{V.sectionTitle}</div></React.Fragment>) : null}{' '}</React.Fragment>) : null
  );
}
