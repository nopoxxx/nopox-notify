# nopox-notify

Плагин [Millennium](https://steambrew.app) для Steam на Linux: уведомления Steam приходят как обычные
системные уведомления (`notify-send`), а свои всплывающие окна Steam больше не показывает.

Сделан для [nopox-shell](https://github.com/nopoxxx/nopox-shell): в niri окно тоста Steam оказывается посреди экрана.
Работает с любым демоном уведомлений (mako, dunst, swaync, KDE, GNOME…).

- сообщения друзей и групповых чатов — имя / текст;
- «друг в игре», «загрузка завершена», заявки, подарки, обмены и прочее — по-русски, с именами друзей и игр;
- критичные уведомления Steam уходят с `urgency=critical`;
- уведомления оверлея внутри игры и звуки Steam не трогаются.

## Установка

Нужны Millennium ≥ 3.4, [Bun](https://bun.com) и `notify-send` (`libnotify`).

```sh
git clone https://github.com/nopoxxx/nopox-notify
cd nopox-notify
bun install && bun run build   # соберёт и положит плагин в ~/.local/share/millennium/plugins/
```

Затем включите **nopox notify** в Steam → Millennium → Plugins и перезапустите Steam.

## Как это работает

Все тосты рабочего стола Steam проходят через `window.NotificationStore.DispatchNextToast()` — он берёт голову
очереди `m_rgNotificationToasts` и отдаёт её окну тостов. Фронтенд плагина оборачивает этот метод и забирает
очередь до показа: Steam видит её пустой и ничего не рисует.

- подпись типа — `NotificationStore.GetNotificationTargets()[eType].strTest`, перевод — `LABELS` во `frontend/index.tsx`;
- данные — `data.toObject()` у уведомлений клиента и JSON `data.item.body_data` у серверных;
- имена друзей — `window.friendStore`, названия игр — `window.appStore`;
- Lua-бэкенд вызывает `notify-send -a Steam` (без `LD_LIBRARY_PATH` рантайма Steam — иначе системные программы ломаются).

Журнал загрузки и ошибок — `~/.cache/nopox-notify.log` (текст уведомлений туда не пишется). Плагин опирается
на внутренности клиента Steam: если после обновления Steam уведомления пропали или вернулись старые тосты,
проверьте, что в журнале при запуске есть строка `hooked NotificationStore.DispatchNextToast`.

Проверка без настоящих событий — в консоли SharedJSContext Steam:

```js
NotificationStore.TestFriendMessage(null, "привет")
NotificationStore.TestFriendIngame("Half-Life 2")
NotificationStore.TestDownloadComplete(220)
```
