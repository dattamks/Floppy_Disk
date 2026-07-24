import React from 'react';
import { hov } from '../lib/ui';

export default function CategoryChip({ V, cat }) {
  return (
    <React.Fragment>{' '}<button onClick={cat.onClick} style={{"flex":"0 0 auto","border":`1px solid ${cat.active ? '#5145E5' : '#E5E7EC'}`,"background":cat.active ? '#5145E5' : '#FFFFFF',"color":cat.active ? '#fff' : '#656B76',"borderRadius":"20px","padding":"7px 14px","fontSize":"12.5px","fontWeight":"600","cursor":"pointer","fontFamily":"'IBM Plex Sans',sans-serif"}}>{cat.label}</button>{' '}</React.Fragment>
  );
}
