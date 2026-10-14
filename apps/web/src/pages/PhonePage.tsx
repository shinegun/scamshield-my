import { useCall } from '../call/CallProvider';
import { CallScreen } from '../call/CallScreen';
import { PhoneFrame } from '../phone/PhoneFrame';
import { ReplayFrontDoor } from '../replay/ReplayFrontDoor';

// The phone: the replay front door until a call starts, then the call.
export function PhonePage() {
  const { status } = useCall();
  return <PhoneFrame>{status === 'idle' ? <ReplayFrontDoor /> : <CallScreen />}</PhoneFrame>;
}
