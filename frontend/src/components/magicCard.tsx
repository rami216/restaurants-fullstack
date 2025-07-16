import React from "react";

const MagicCard = () => {
  return (
    <div className="p-4 w-[300px] rounded-lg border dark:border-gray-800">
      <h1 className="text-2xl font-bold">Simple</h1>
      <div className="grid gap-4 mt-2">
        <div className="flex gap-2 items-center">
          <div className="bg-red-500 w-20 h-10 rounded" />
          <div className="grid gap-1 text-sm flex-1">
            <h2 className="font-semibold leading-none line-clamp-2">
              Setup your restaurant, easily
            </h2>
            <div className="text-xs text-gray-500 line-clamp-1 dark:text-gray-400">
              add menus, extras, schedules, etc...
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* use a valid shade */}
          <div className="bg-orange-500 w-20 h-10 rounded" />
          <div className="grid gap-1 text-sm flex-1">
            <h2 className="font-semibold leading-none line-clamp-2">
              Test your chatbot
            </h2>
            <div className="text-xs text-gray-500 line-clamp-1 dark:text-gray-400">
              a custom link is generated instantly
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* use a valid shade */}
          <div className="bg-green-500 w-20 h-10 rounded" />
          <div className="grid gap-1 text-sm flex-1">
            <h2 className="font-semibold leading-none line-clamp-2">
              Share the link on social media
            </h2>
            <div className="text-xs text-gray-500 line-clamp-1 dark:text-gray-400">
              your custom chatbot webpage!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MagicCard;
