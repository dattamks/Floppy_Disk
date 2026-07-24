import React from 'react';
import { hov } from '../lib/ui';

export default function TrendingCard({ V, t }) {
  return (
    <React.Fragment>{' '}<div onClick={t.onOpen} style={{"flex":"0 0 168px","cursor":"pointer","display":"flex","flexDirection":"column","gap":"7px"}}>{' '}<div style={{"position":"relative","height":"100px","borderRadius":"12px","overflow":"hidden","background":"#000"}}><img ref={t.imgRef} alt="" style={{"width":"100%","height":"100%","objectFit":"cover","display":"block"}} /><div style={{"position":"absolute","bottom":"6px","right":"6px","background":"rgba(10,12,20,0.72)","borderRadius":"5px","padding":"2px 7px","fontSize":"10px","color":"#fff","fontWeight":"600"}}>{t.metricLabel}</div></div>{' '}<span style={{"fontSize":"11.5px","color":"#656B76","fontWeight":"500","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>{t.channelName}</span>{' '}</div>{' '}</React.Fragment>
  );
}
