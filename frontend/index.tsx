// nopox-notify: уведомления Steam — системными (notify-send) вместо собственных тостов Steam.
// Все тосты рабочего стола проходят через window.NotificationStore.DispatchNextToast():
// он берёт голову очереди m_rgNotificationToasts и отдаёт её окну тостов. Обёртка забирает
// очередь до этого — Steam видит её пустой и ничего не рисует, а текст уходит в backend.notify().
// Тосты оверлея в игре (m_mapAppOverlayToasts) и звук Steam не трогаем.
import { definePlugin, Field } from 'millennium';

const w = window as any;

type Toast = { notificationID: unknown; eType: number; eSource: number; data: any };

// подписи типов из GetNotificationTargets()[eType].strTest (английские, тестовые; регистр у Steam
// гуляет — ключи в нижнем регистре) → по-русски; {game} — название игры из уведомления
const LABELS: Record<string, string> = {
	'friend message': 'сообщение',
	'group chat msg': 'сообщение в группе',
	'friend invite rollup': 'заявки в друзья',
	'friend invite': 'заявка в друзья',
	'friend online': 'в сети',
	'friend in game': 'играет в {game}',
	'gift received': 'подарок',
	'wishlist': 'скидка из списка желаемого: {game}',
	'trade offer': 'предложение обмена',
	'comment': 'комментарий',
	'screenshot': 'скриншот',
	'cloud sync conflict': 'конфликт синхронизации Steam Cloud: {game}',
	'cloud sync failure': 'ошибка синхронизации Steam Cloud: {game}',
	'incoming voice chat': 'входящий голосовой звонок',
	'system update': 'обновление системы',
	'hardware update': 'обновление устройства',
	'hardware survey': 'опрос о системе',
	'item announcement': 'новые предметы',
	'download complete': 'загрузка завершена: {game}',
};

const STEAMID64_BASE = BigInt('76561197960265728');

function friendName(id: unknown): string | undefined {
	if (id === undefined || id === null || id === '') return undefined;
	try {
		const n = BigInt(id as string | number);
		const account = Number(n >= STEAMID64_BASE ? n - STEAMID64_BASE : n);
		return w.friendStore?.GetFriendState?.(account)?.display_name || undefined;
	} catch {
		return undefined;
	}
}

function appName(appid: unknown): string | undefined {
	if (!appid) return undefined;
	try {
		return w.appStore?.GetAppOverviewByAppID?.(Number(appid))?.display_name || undefined;
	} catch {
		return undefined;
	}
}

// данные: у уведомлений клиента — protobuf (toObject), у серверных — JSON в item.body_data
function payload(t: Toast): any {
	try {
		if (t.eSource === 2) return JSON.parse(t.data?.item?.body_data ?? '{}');
		return t.data?.toObject?.() ?? {};
	} catch {
		return {};
	}
}

function describe(t: Toast, label: string): { title: string; body: string } {
	const o = payload(t);
	const sender = o.steamid ?? o.requestor_id ?? o.gifter_account ?? o.accountid_owner ?? o.steamid_sender;
	// сразу после запуска Steam друзья ещё не загружены — тогда имени нет, пишем «друг»
	const who = sender ? friendName(sender) || 'друг' : undefined;
	// сообщения друзей и чатов уже несут готовые заголовок и текст
	if (o.title || o.body) return { title: String(o.title || who || 'Steam'), body: String(o.body || label) };
	const game = o.game_name || appName(o.appid) || '';
	const text = label.includes('{game}')
		? (game ? label.replace('{game}', game) : label.replace(/:? ?\{game\}/, ''))
		: [label, game].filter(Boolean).join(': ');
	if (who) return { title: who, body: text };
	// без отправителя: «Загрузка завершена» заголовком, игра — текстом
	const head = label.replace(/:? ?\{game\}/, '');
	if (head) return { title: head[0].toUpperCase() + head.slice(1), body: game };
	return { title: 'Steam', body: game || 'уведомление' };
}

function forward(store: any, t: Toast) {
	const target = store.GetNotificationTargets?.()?.[t.eType];
	const strTest: string | undefined = target?.strTest;
	const label = (strTest && LABELS[strTest.toLowerCase()]) || strTest || '';
	const { title, body } = describe(t, label);
	backend.notify(title, body, target?.bCritical ? 'critical' : 'normal');
}

function install(): boolean {
	const store = w.NotificationStore;
	if (!store?.DispatchNextToast || !Array.isArray(store.m_rgNotificationToasts)) return false;
	if (store.__nopoxNotify) return true;
	const original = store.DispatchNextToast;
	store.DispatchNextToast = function (this: any, ...args: unknown[]) {
		const queue: Toast[] = this.m_rgNotificationToasts;
		while (queue.length) {
			const t = queue.shift()!;
			try {
				forward(this, t);
			} catch (e) {
				backend.log(`forward failed: ${e}`);
			}
		}
		return original.apply(this, args);
	};
	store.__nopoxNotify = true;
	backend.log('hooked NotificationStore.DispatchNextToast');
	return true;
}

export default definePlugin(() => {
	// NotificationStore создаётся вместе с интерфейсом Steam — ждём его
	if (!install()) {
		const timer = setInterval(() => install() && clearInterval(timer), 500);
	}
	return {
		title: 'nopox notify',
		icon: <span>🔔</span>,
		content: <Field label="Уведомления Steam уходят в системные (notify-send)" />,
	};
});
