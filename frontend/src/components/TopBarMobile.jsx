import React from 'react';
import { hov } from '../lib/ui';

// Extracted from AppShell.
export default function TopBarMobile(V) {
  return (
    (V.isMobile) ? (<React.Fragment>{' '}<button onClick={V.openDrawer} style={{"background":"#F1F2F5","border":"1px solid #E5E7EC","borderRadius":"9px","width":"34px","height":"34px","display":"flex","alignItems":"center","justifyContent":"center","cursor":"pointer","flex":"0 0 auto"}}><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="#15171C" strokeWidth="1.9" strokeLinecap="round" /></svg></button>{' '}<span style={{"fontFamily":"'Space Grotesk',sans-serif","fontWeight":"700","fontSize":"16px","flex":"1","minWidth":"0","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>{V.sectionTitle}</span>{' '}<button onClick={V.toggleMobileSearch} style={{"background":"#F1F2F5","border":"1px solid #E5E7EC","borderRadius":"9px","width":"34px","height":"34px","display":"flex","alignItems":"center","justifyContent":"center","cursor":"pointer","flex":"0 0 auto"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#656B76" strokeWidth="1.8" /><path d="M20 20l-4.3-4.3" stroke="#656B76" strokeWidth="1.8" strokeLinecap="round" /></svg></button>{' '}<button onClick={V.openSettings} style={{"width":"32px","height":"32px","borderRadius":"50%","background":"#5145E5","border":"none","display":"flex","alignItems":"center","justifyContent":"center","fontSize":"12.5px","fontWeight":"600","color":"#fff","fontFamily":"'Space Grotesk',sans-serif","flex":"0 0 auto","cursor":"pointer"}}>A</button>{' '}</React.Fragment>) : null
  );
}
