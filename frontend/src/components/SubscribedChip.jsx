import React from 'react';
import { hov } from '../lib/ui';

export default function SubscribedChip({ V, ch }) {
  return (
    <React.Fragment>{' '}<div onClick={ch.onView} style={{"display":"flex","flexDirection":"column","alignItems":"center","gap":"6px","flex":"0 0 auto","width":"60px","cursor":"pointer"}}>{' '}<div style={{"width":"52px","height":"52px","borderRadius":"50%","background":ch.color,"display":"flex","alignItems":"center","justifyContent":"center","color":"#fff","fontFamily":"'Space Grotesk',sans-serif","fontWeight":"700","fontSize":"15px","position":"relative"}}>{ch.initials}{(ch.live) ? (<React.Fragment><span style={{"position":"absolute","bottom":"-3px","background":"#E5484D","color":"#fff","fontSize":"7px","fontWeight":"700","borderRadius":"4px","padding":"1px 4px","border":"2px solid #F4F5F8"}}>LIVE</span></React.Fragment>) : null}</div>{' '}<span style={{"fontSize":"10.5px","color":"#656B76","textAlign":"center","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap","maxWidth":"60px"}}>{ch.name}</span>{' '}</div>{' '}</React.Fragment>
  );
}
