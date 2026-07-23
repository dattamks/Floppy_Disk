import React from 'react';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.toastVisible is set.
export default function Toast(V) {
  return (
    (V.toastVisible) ? (<React.Fragment>{' '}<div style={{"position":"absolute","bottom":`${V.toastBottom}px`,"left":"50%","transform":"translateX(-50%)","background":"#15171C","color":"#fff","fontSize":"13px","padding":"11px 18px","borderRadius":"10px","boxShadow":"0 10px 24px rgba(0,0,0,0.28)","zIndex":"60","whiteSpace":"nowrap"}}>{V.toastMsg}</div>{' '}</React.Fragment>) : null
  );
}
