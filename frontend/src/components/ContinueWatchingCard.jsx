import React from 'react';
import { hov } from '../lib/ui';

// One card in the grid/carousel. Receives the view-model V and its item.
export default function ContinueWatchingCard({ V, c }) {
  return (
    <React.Fragment>{' '}<div onClick={c.onOpen} style={{"flex":`0 0 ${V.d.carouselW}px`,"scrollSnapAlign":"start","cursor":"pointer","display":"flex","flexDirection":"column","gap":"8px"}}>{' '}<div style={{"position":"relative","height":`${V.d.carouselH}px`,"borderRadius":"13px","overflow":"hidden","background":"#000"}}>{' '}<img ref={c.imgRef} alt="" style={{"width":"100%","height":"100%","objectFit":"cover","display":"block"}} />{' '}<div style={{"position":"absolute","inset":"0","display":"flex","alignItems":"center","justifyContent":"center","background":"rgba(10,12,20,0.18)"}}><div style={{"width":"40px","height":"40px","borderRadius":"50%","background":"rgba(255,255,255,0.92)","display":"flex","alignItems":"center","justifyContent":"center","boxShadow":"0 4px 12px rgba(0,0,0,0.25)"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="#15171C"><path d="M6 4l14 8-14 8V4Z" /></svg></div></div>{' '}<div style={{"position":"absolute","bottom":"7px","right":"7px","background":"rgba(10,12,20,0.72)","borderRadius":"5px","padding":"1px 6px","fontSize":"10.5px","color":"#fff"}}>{c.duration}</div>{' '}<div style={{"position":"absolute","left":"0","right":"0","bottom":"0","height":"4px","background":"rgba(255,255,255,0.35)"}}><div style={{"height":"100%","background":"#5145E5","width":`${c.watchedPct}%`}} /></div>{' '}</div>{' '}<span style={{"fontSize":"12.5px","fontWeight":"500","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>{c.title}</span>{' '}</div>{' '}</React.Fragment>
  );
}
