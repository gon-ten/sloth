import { useState } from "preact/hooks";

type Props = {
  content?: string;
};

export const Counter = ({}: Props) => {
  const [test, setTest] = useState(0);
  const active = test % 2 === 0;

  const a = () => (active ? "text-red-500" : "text-orange-400");

  return (
    <div
      className={a()}
      onClick={() => {
        setTest((prev) => prev + 1);
      }}
    >
      {test}
    </div>
  );
};
