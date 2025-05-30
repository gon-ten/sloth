export const Backdrop = () => {
  return (
    <div className='fixed inset-0 flex justify-center sm:px-8'>
      <div className='flex w-full max-w-7xl lg:px-8'>
        <div className='transition w-full bg-white ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-300/20'>
        </div>
      </div>
    </div>
  );
};
