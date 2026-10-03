"use strict";
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
const time = (seconds) =>
    `${Math.floor((seconds || 0) / 60)}:${Math.floor((seconds || 0) % 60)
        .toString()
        .padStart(2, "0")}`;
function icon(name) {
    const paths = {
        previous: "M6 5v14M19 5l-10 7 10 7z",
        next: "M18 5v14M5 5l10 7-10 7z",
        play: "M7 4l13 8-13 8z",
        pause: "M8 5v14M16 5v14",
        shuffle: "M3 6h3c6 0 6 12 12 12h3M18 15l3 3-3 3M3 18h3c2 0 4-3 6-6s4-6 6-6h3M18 3l3 3-3 3",
        loop: "M4 8a4 4 0 014-4h12M17 1l3 3-3 3M20 16a4 4 0 01-4 4H4M7 17l-3 3 3 3",
    };
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.play}"/></svg>`;
}
let csrf = "",
    guildId = "",
    page = "overview",
    dirty = false,
    settings,
    overview,
    guilds = [],
    poll,
    stream,
    requestVersion = 0;
let searchDraft = { query: "", channelId: "", result: null },
    searchBusy = false;
const names = {
    emojis: "Music emojis",
    tickets: "Tickets",
    automod: "AutoMod",
    cases: "Moderation cases",
    overview: "Overview",
    welcome: "Welcome builder",
    goodbye: "Goodbye builder",
    settings: "Server settings",
    music: "Music player",
    history: "Listening history",
    favorites: "Your favorites",
    playlists: "Your playlists",
    audit: "Audit log",
    owner: "System health",
};
async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.error || "Request failed");
        error.status = response.status;
        throw error;
    }
    return data;
}
function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
function heading(title, subtitle, tag = "") {
    return `<div class="page-heading"><div><p class="eyebrow">${page === "music" ? "YOUR SOUND, YOUR SPACE" : "COMMUNITY WORKSPACE"}</p><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p></div>${tag ? `<span class="pill">${esc(tag)}</span>` : ""}</div>`;
}
function empty(title, description) {
    return `<div class="empty"><div class="empty-icon">♫</div><h3>${esc(title)}</h3><p>${esc(description)}</p></div>`;
}
async function mayLeave() {
    if (!dirty) return true;
    const dialog = $("#confirm");
    dialog.showModal();
    return new Promise((resolve) =>
        dialog.addEventListener("close", () => resolve(dialog.returnValue === "leave"), { once: true }),
    );
}
async function navigate(next) {
    if (!(await mayLeave())) return;
    dirty = false;
    searchDraft = { query: "", channelId: "", result: null };
    searchBusy = false;
    page = next;
    clearTimeout(poll);
    stream?.close();
    stream = null;
    const version = ++requestVersion;
    $("#breadcrumb").textContent = names[page];
    document.title = `${names[page]} · Zeechei`;
    document
        .querySelectorAll("[data-page]")
        .forEach((button) => button.classList.toggle("active", button.dataset.page === page));
    $("#sidebar").classList.remove("open");
    $("#menu").setAttribute("aria-expanded", "false");
    $("#page").innerHTML = '<div class="skeleton" aria-label="Loading"></div>';
    try {
        if (!guildId && !["owner", "emojis"].includes(page)) return renderGuilds();
        if (page === "emojis") {
            const data = await api("/owner/emojis");
            if (version === requestVersion) renderEmojis(data);
            return;
        }
        if (page === "music") {
            const [state, details] = await Promise.all([
                api(`/guilds/${guildId}/music`),
                api(`/guilds/${guildId}/overview`),
            ]);
            if (version === requestVersion) {
                overview = details;
                renderMusic(state);
                connectMusic(version);
            }
            return;
        }
        if (page === "overview") {
            overview = await api(`/guilds/${guildId}/overview`);
            if (version !== requestVersion) return;
            $("#page").innerHTML =
                heading(
                    `Welcome to ${overview.name}`,
                    "A little closer to your community.",
                    "Server overview",
                ) +
                `<div class="grid"><section class="panel stat"><small>Community members</small><strong>${overview.members.toLocaleString()}</strong></section><section class="panel stat"><small>Text channels</small><strong>${overview.channels.length}</strong></section><section class="panel stat"><small>Server roles</small><strong>${overview.roles.length}</strong></section></div><div class="grid spaced"><section class="panel"><p class="eyebrow">MUSIC STUDIO</p><h2>Set the mood.</h2><p class="sub">Your Discord player, right here.</p><div class="actions"><button data-go="music">Open player ↗</button></div></section><section class="panel"><p class="eyebrow">FIRST IMPRESSIONS</p><h2>Make them feel at home.</h2><p class="sub">Build a welcome with personality.</p><div class="actions"><button data-go="welcome">Welcome builder ↗</button></div></section><section class="panel"><p class="eyebrow">YOUR COMMUNITY</p><h2>Make it your own.</h2><p class="sub">Update roles, logs, and preferences.</p><div class="actions"><button data-go="settings">Server settings ↗</button></div></section></div>`;
            $("#page")
                .querySelectorAll("[data-go]")
                .forEach((button) => (button.onclick = () => navigate(button.dataset.go)));
            return;
        }
        if (["welcome", "goodbye", "settings", "automod", "tickets"].includes(page)) {
            const results = await Promise.all([
                api(`/guilds/${guildId}/settings`),
                api(`/guilds/${guildId}/overview`),
            ]);
            if (version !== requestVersion) return;
            [settings, overview] = results;
            if (page === "settings") renderSettings();
            else if (page === "automod") renderAutoMod();
            else if (page === "tickets") renderTickets();
            else renderGreeting();
            return;
        }
        const data = await api(page === "owner" ? "/owner" : `/guilds/${guildId}/${page}`);
        if (version !== requestVersion) return;
        if (page === "owner") {
            $("#page").innerHTML =
                heading("System health", "Live service information.", "Owner") +
                `<div class="grid">${[
                    ["Discord", data.bot ? "Connected" : "Offline"],
                    ["Lavalink", data.lavalink ? "Connected" : "Unavailable"],
                    ["Storage", data.databaseBackend],
                    ["Memory", `${Math.round(data.memory / 1048576)} MB`],
                    ["Guilds", data.guildCount],
                    ["Uptime", `${Math.floor(data.uptime / 60)} min`],
                ]
                    .map(
                        ([label, value]) =>
                            `<section class="panel stat"><small>${esc(label)}</small><strong>${esc(value)}</strong></section>`,
                    )
                    .join("")}</div>`;
            return;
        }
        if (["favorites", "playlists"].includes(page)) return renderLibrary(data);
        let rows = Array.isArray(data)
            ? [...data].reverse()
            : Object.entries(data).map(([name, tracks]) => ({
                  name,
                  description: `${tracks.length} tracks`,
              }));
        $("#page").innerHTML =
            heading(
                names[page],
                page === "audit"
                    ? "Recent dashboard configuration changes."
                    : "Your listening journey, all in one place.",
            ) +
            `<section class="panel">${rows.length ? rows.map((row) => `<article class="list-card"><h3>${esc(row.number ? `Case #${row.number} · ${row.action}` : row.name || row.action || row.title || "Track")}</h3><p>${esc(row.reason || row.description || row.artist || row.url || "")}</p>${row.at ? `<small class="muted">${esc(new Date(row.at).toLocaleString())} · ${esc(row.actor)} · ${esc(row.fields?.join(", "))}</small>` : ""}</article>`).join("") : empty("Nothing here yet", page === "audit" ? "Configuration updates will appear here." : "Use the music controls in Discord to start your collection.")}</section>`;
    } catch (error) {
        if (version === requestVersion)
            $("#page").innerHTML =
                heading("Couldn’t load this page", error.message) + '<button id="retry">Try again</button>';
        $("#retry")?.addEventListener("click", () => navigate(page));
    }
}
function renderGuilds() {
    $("#page").innerHTML =
        heading("Your servers", "Choose a community to make it yours.") +
        `<div class="guild-grid">${guilds.map((guild) => `<article class="panel guild-card">${guild.icon ? `<img class="track-thumb" src="${esc(guild.icon)}" alt="">` : '<span class="brandmark">z</span>'}<h2>${esc(guild.name)}</h2>${guild.installed ? `<button data-guild="${esc(guild.id)}" class="primary">Manage server ↗</button>` : `<a class="button" href="${esc(guild.invite)}" target="_blank" rel="noopener noreferrer">Add Zeechei ↗</a>`}</article>`).join("")}</div>${guilds.length ? "" : empty("No manageable servers", "You need Manage Server or Administrator permission.")}`;
    document
        .querySelectorAll("[data-guild]")
        .forEach((button) => (button.onclick = () => chooseGuild(button.dataset.guild)));
}
async function chooseGuild(id) {
    if (!(await mayLeave())) {
        $("#guild-select").value = guildId;
        return;
    }
    dirty = false;
    guildId = id;
    $("#guild-select").value = id;
    navigate("overview");
}
function renderMusic(state) {
    const track = state.track,
        active = Boolean(track),
        pending = state.status === "loading";
    $("#page").innerHTML =
        heading(
            "Music player",
            "Good company deserves a great soundtrack.",
            state.available ? "Lavalink connected" : "Node unavailable",
        ) +
        `<div class="player-layout"><section class="panel player ${state.status === "playing" ? "playing" : ""}"><div class="player-top"><span>${esc(state.status.toUpperCase())}</span><span class="equalizer" aria-hidden="true">${"<i></i>".repeat(5)}</span></div><div class="artwork">${track?.artwork ? `<img src="${esc(track.artwork)}" alt="${esc(track.title)} artwork">` : '<span class="fallback" aria-hidden="true">♫</span>'}</div><h2 class="track-title">${esc(track?.title || "A moment of quiet.")}</h2><p class="track-artist">${esc(track?.artist || "Join a Discord voice channel, then find your next track.")}</p><input id="seek" class="progress" type="range" aria-label="Playback position" min="0" max="${Math.max(1, Math.floor(track?.duration || 1))}" value="${Math.floor(state.position)}" ${!active || track?.live ? "disabled" : ""}><div class="time"><span>${time(state.position)}</span><span>${track?.live ? "LIVE" : time(track?.duration)}</span></div><div class="controls"><button data-control="shuffle" title="Shuffle queue" aria-label="Shuffle queue" ${!active ? "disabled" : ""}>${icon("shuffle")}</button><button data-control="previous" title="Previous" aria-label="Previous track" ${!active ? "disabled" : ""}>${icon("previous")}</button><button class="primary" data-control="${state.status === "paused" ? "resume" : "pause"}" aria-label="${state.status === "paused" ? "Resume" : "Pause"}" ${!active || pending ? "disabled" : ""}>${icon(state.status === "paused" ? "play" : "pause")}</button><button data-control="skip" title="Next" aria-label="Next track" ${!active ? "disabled" : ""}>${icon("next")}</button><button class="${state.loop ? "selected" : ""}" data-control="loop" aria-label="Loop ${["off", "track", "queue"][state.loop]}" title="Loop ${["off", "track", "queue"][state.loop]}" ${!active ? "disabled" : ""}>${icon("loop")}${state.loop === 1 ? "<small>1</small>" : ""}</button></div><div class="player-bottom"><span>${esc(track?.requester ? `Requested by ${track.requester}` : "Your next favorite is waiting.")}</span><label class="volume">Volume <input id="volume" type="range" aria-label="Volume" min="0" max="150" value="${state.volume}" ${!active ? "disabled" : ""}><span>${state.volume}%</span></label></div></section><div class="stack">${searchPanel()}<section class="panel"><div class="section-head"><h2>Up next <small> · ${state.queue.length}</small></h2><button data-control="clear" class="text-button" ${!state.queue.length ? "disabled" : ""}>Clear</button></div><div class="queue-list">${state.queue.length ? state.queue.map((song, index) => `<div class="track-row">${song.artwork ? `<img class="track-thumb" src="${esc(song.artwork)}" alt="">` : '<span class="track-thumb">♫</span>'}<div class="track-info"><strong>${esc(song.title)}</strong><small>${esc(song.artist)}</small></div><small>${time(song.duration)}</small><button data-remove="${index + 1}" aria-label="Remove ${esc(song.title)}">×</button></div>`).join("") : empty("Room for another track", "Search for a song or paste a supported music URL.")}</div></section><section class="panel"><div class="section-head"><h2>Make it yours</h2><span class="badge">AUDIO</span></div><label class="field">Audio effect<select id="filter" ${!active ? "disabled" : ""}><option value="normal">Normal · original sound</option>${state.supportedFilters.map((name) => `<option ${state.filters.includes(name) ? "selected" : ""} value="${esc(name)}">${esc(name)}</option>`).join("")}</select></label><div class="section-head"><span class="sub">Keep the music going</span><button data-control="autoplay" aria-pressed="${state.autoplay}" ${!active ? "disabled" : ""}>Autoplay ${state.autoplay ? "on" : "off"}</button></div><button data-control="stop" class="text-button" ${!active ? "disabled" : ""}>Stop playback</button></section><p class="muted">Controls follow your Discord voice membership and DJ permissions.</p></div></div>`;
    document
        .querySelectorAll("[data-control]")
        .forEach((button) => (button.onclick = () => musicAction(button.dataset.control)));
    document
        .querySelectorAll("[data-remove]")
        .forEach((button) => (button.onclick = () => musicAction("remove", Number(button.dataset.remove))));
    wireSearch();
    $("#volume").onchange = (event) => musicAction("volume", Number(event.target.value));
    $("#seek").onchange = (event) => musicAction("seek", Number(event.target.value));
    $("#filter").onchange = (event) => musicAction("filter", event.target.value);
    $("#page")
        .querySelectorAll("img")
        .forEach((img) =>
            img.addEventListener(
                "error",
                () => {
                    const fallback = document.createElement("span");
                    fallback.className = img.className || "fallback";
                    fallback.textContent = "♫";
                    img.replaceWith(fallback);
                },
                { once: true },
            ),
        );
}
async function musicAction(action, value) {
    const version = requestVersion;
    clearTimeout(poll);
    try {
        const state = await api(`/guilds/${guildId}/music`, {
            method: "POST",
            body: JSON.stringify({ action, value }),
        });
        if (page === "music" && version === requestVersion) renderMusic(state);
    } catch (error) {
        toast(error.message);
    } finally {
        if (!stream) scheduleMusic(version);
    }
}
function connectMusic(version) {
    stream = new EventSource(`/api/guilds/${guildId}/stream`);
    stream.onmessage = (event) => {
        if (
            page === "music" &&
            version === requestVersion &&
            !document.hidden &&
            !searchBusy &&
            !$("#page").contains(document.activeElement)
        ) {
            try {
                renderMusic(JSON.parse(event.data));
            } catch {
                toast("Player update unavailable.");
            }
        }
    };
    stream.onerror = () => {
        stream?.close();
        stream = null;
        scheduleMusic(version);
    };
}
function scheduleMusic(version) {
    clearTimeout(poll);
    poll = setTimeout(async () => {
        if (page !== "music" || version !== requestVersion) return;
        if (document.hidden || searchBusy || $("#page").contains(document.activeElement))
            return scheduleMusic(version);
        try {
            const state = await api(`/guilds/${guildId}/music`);
            if (version === requestVersion) renderMusic(state);
        } catch (error) {
            toast(error.message);
        }
        scheduleMusic(version);
    }, 15000);
}
function searchPanel() {
    const result = searchDraft.result;
    return `<section class="panel"><h2>Find your next track</h2><form id="music-search-form"><label class="field">Song, artist or music URL<input name="query" type="search" required maxlength="2000" value="${esc(searchDraft.query)}" placeholder="What are we listening to?"></label><label class="field">Discord player channel<select name="channelId">${channelOptions(searchDraft.channelId)}</select></label><button class="primary" type="submit" ${searchBusy ? "disabled" : ""}>${searchBusy ? "Finding music…" : "Search music"}</button></form><div id="search-results" aria-live="polite">${result ? `<p class="muted">Choose a result. Available for two minutes.</p>${result.options.map((option) => `<article class="track-row"><div class="track-info"><strong>${esc(option.title)}</strong><small>${esc(option.artist)}${option.duration ? ` · ${time(option.duration)}` : ""}</small></div><button data-enqueue="${option.index}" ${searchBusy ? "disabled" : ""} aria-label="Add ${esc(option.title)} to queue">Add${option.count > 1 ? ` ${option.count}` : ""}</button></article>`).join("")}` : ""}</div></section>`;
}
function wireSearch() {
    const form = $("#music-search-form");
    form.oninput = () => {
        searchDraft.query = form.elements.query.value;
        searchDraft.channelId = form.elements.channelId.value;
    };
    form.onsubmit = async (event) => {
        event.preventDefault();
        if (searchBusy) return;
        const version = requestVersion;
        searchDraft.query = form.elements.query.value;
        searchDraft.channelId = form.elements.channelId.value;
        searchBusy = true;
        const button = form.querySelector("button");
        button.disabled = true;
        button.textContent = "Finding music…";
        try {
            const result = await api(`/guilds/${guildId}/music-search`, {
                method: "POST",
                body: JSON.stringify({ query: searchDraft.query }),
            });
            if (version !== requestVersion) return;
            searchDraft.result = result;
        } catch (error) {
            if (version !== requestVersion) return;
            searchDraft.result = null;
            toast(error.message);
        } finally {
            if (version === requestVersion) {
                searchBusy = false;
                form.closest("section").outerHTML = searchPanel();
                wireSearch();
                $("#search-results button")?.focus();
            }
        }
    };
    document.querySelectorAll("[data-enqueue]").forEach((button) => {
        button.onclick = async () => {
            if (searchBusy) return;
            const version = requestVersion;
            searchBusy = true;
            document
                .querySelectorAll("[data-enqueue], #music-search-form button")
                .forEach((item) => (item.disabled = true));
            try {
                const response = await api(`/guilds/${guildId}/music-enqueue`, {
                    method: "POST",
                    body: JSON.stringify({
                        token: searchDraft.result.token,
                        index: Number(button.dataset.enqueue),
                        ...(searchDraft.channelId ? { channelId: searchDraft.channelId } : {}),
                    }),
                });
                if (version !== requestVersion) return;
                searchDraft.result = null;
                searchBusy = false;
                renderMusic(response.state);
                toast(`Added ${response.count} ${response.count === 1 ? "track" : "tracks"} to queue.`);
            } catch (error) {
                if (version === requestVersion) toast(error.message);
            } finally {
                if (version === requestVersion) {
                    searchBusy = false;
                    document
                        .querySelectorAll("[data-enqueue], #music-search-form button")
                        .forEach((item) => (item.disabled = false));
                }
            }
        };
    });
}
async function confirmAction(title, description) {
    const dialog = $("#action-confirm");
    dialog.querySelector("h2").textContent = title;
    dialog.querySelector("p").textContent = description;
    dialog.showModal();
    return new Promise((resolve) =>
        dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }),
    );
}
function renderLibrary(data) {
    const section = page,
        version = requestVersion,
        targetGuild = guildId;
    const playlists = section === "playlists";
    const trackRows = (songs, name = "") =>
        songs
            .map(
                (song) =>
                    `<article class="track-row"><div class="track-info"><strong>${esc(song.name)}</strong><small>${esc(song.duration || "Saved track")}</small></div><button data-library-action="remove" data-name="${esc(name)}" data-url="${esc(song.url)}" aria-label="Remove ${esc(song.name)}">Remove</button></article>`,
            )
            .join("");
    $("#page").innerHTML =
        heading(names[page], "Your collection stays with you, in Discord and on the web.") +
        (playlists
            ? `<form id="create-playlist" class="panel"><label class="field">New playlist name<input name="name" required maxlength="40" placeholder="Late night favorites"></label><button class="primary" type="submit">Create playlist</button></form><div class="spaced">${
                  Object.entries(data.items)
                      .map(
                          ([name, songs]) =>
                              `<section class="panel spaced"><div class="section-head"><h2>${esc(name)} <small>· ${songs.length}</small></h2><button data-library-action="delete" data-name="${esc(name)}">Delete playlist</button></div><button data-library-action="addCurrent" data-name="${esc(name)}">Save current track</button>${songs.length ? trackRows(songs, name) : empty("A new beginning", "Play a track, then save it to this playlist.")}</section>`,
                      )
                      .join("") ||
                  empty("Your first mixtape awaits", "Create a playlist to start collecting tracks.")
              }</div>`
            : `<section class="panel"><div class="section-head"><h2>Saved tracks <small>· ${data.items.length}</small></h2><button data-library-action="addCurrent">Save current track</button></div>${data.items.length ? trackRows(data.items) : empty("Find something you love", "Save the current Discord track to keep it here.")}</section>`);
    let busy = false;
    async function mutate(input) {
        if (busy) return;
        busy = true;
        $("#page")
            .querySelectorAll("button")
            .forEach((button) => (button.disabled = true));
        try {
            const result = await api(`/guilds/${targetGuild}/${section}`, {
                method: "POST",
                body: JSON.stringify({ ...input, version: data.version }),
            });
            if (version !== requestVersion) return;
            renderLibrary(result);
            toast("Library saved.");
        } catch (error) {
            toast(error.message);
            if (error.status === 409 && version === requestVersion) await navigate(section);
        } finally {
            busy = false;
            if (version === requestVersion)
                $("#page")
                    .querySelectorAll("button")
                    .forEach((button) => (button.disabled = false));
        }
    }
    $("#create-playlist")?.addEventListener("submit", (event) => {
        event.preventDefault();
        mutate({ action: "create", name: event.target.elements.name.value });
    });
    document.querySelectorAll("[data-library-action]").forEach((button) => {
        button.onclick = async () => {
            const action = button.dataset.libraryAction;
            if (
                ["delete", "remove"].includes(action) &&
                !(await confirmAction(
                    action === "delete" ? "Delete this playlist?" : "Remove this track?",
                    "This updates your personal library in Discord too.",
                ))
            )
                return;
            if (version !== requestVersion) return;
            mutate({
                action,
                ...(button.dataset.name ? { name: button.dataset.name } : {}),
                ...(button.dataset.url ? { url: button.dataset.url } : {}),
            });
        };
    });
}
function channelOptions(value) {
    return (
        '<option value="">Not configured</option>' +
        overview.channels
            .map(
                (channel) =>
                    `<option value="${channel.id}" ${channel.id === value ? "selected" : ""}># ${esc(channel.name)}</option>`,
            )
            .join("")
    );
}
function field(name, label, value, type = "text") {
    return `<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}"></label>`;
}
function checkbox(name, label, checked) {
    return `<label class="check"><input name="${name}" type="checkbox" ${checked ? "checked" : ""}>${esc(label)}</label>`;
}
function saveFooter() {
    return '<div class="actions"><span class="save-status" role="status">All changes saved</span><button type="button" id="reset">Reset form</button><button class="primary" type="submit">Save changes</button></div>';
}
function wireForm(getPatch) {
    const form = $("#settings-form");
    form.addEventListener("input", () => {
        dirty = true;
        $(".save-status").textContent = "Unsaved changes";
    });
    $("#reset").onclick = () => {
        form.reset();
        dirty = false;
        $(".save-status").textContent = "All changes saved";
        form.dispatchEvent(new Event("reset-preview"));
    };
    form.onsubmit = async (event) => {
        event.preventDefault();
        const button = form.querySelector("[type=submit]");
        button.disabled = true;
        $(".save-status").textContent = "Saving…";
        try {
            settings = await api(`/guilds/${guildId}/settings`, {
                method: "PATCH",
                body: JSON.stringify({ version: settings.version, patch: getPatch(form) }),
            });
            dirty = false;
            toast("Settings saved. Changes apply to the bot immediately.");
            if (page === "settings") renderSettings();
            else if (page === "automod") renderAutoMod();
            else if (page === "tickets") renderTickets();
            else renderGreeting();
        } catch (error) {
            toast(error.message);
            $(".save-status").textContent = "Not saved";
        } finally {
            button.disabled = false;
        }
    };
}
function greetingData() {
    const saved = settings.data[page],
        defaults = settings.defaults[page] || {};
    return {
        enabled: defaults.enabled !== false,
        channelId: settings.data[`${page}Channel`] || defaults.channelId || "",
        message: defaults.message || "Welcome {user} to {server}!",
        title: page === "welcome" ? "Welcome to {server}" : "Until next time, {username}",
        description: "You are part of our story.",
        color: "#b7a4ef",
        image: "",
        thumbnail: true,
        useCard: true,
        dm: false,
        buttonLabel: "",
        buttonUrl: "",
        ...saved,
    };
}
function renderGreeting() {
    const data = greetingData();
    $("#page").innerHTML =
        heading(names[page], "Make every arrival and farewell feel personal.", "Live preview") +
        `<div class="form-grid"><form id="settings-form" class="panel">${checkbox("enabled", `Enable ${page} messages`, data.enabled)}<label class="field">Destination channel<select name="channelId">${channelOptions(data.channelId)}</select></label><label class="field">Message<textarea name="message" maxlength="1800">${esc(data.message)}</textarea></label>${field("title", "Embed title", data.title)}<label class="field">Description<textarea name="description" maxlength="1800">${esc(data.description)}</textarea></label><div class="form-row">${field("color", "Accent color", data.color, "color")}${field("image", "Banner URL (HTTPS)", data.image, "url")}</div>${checkbox("thumbnail", "Show member avatar", data.thumbnail)}${checkbox("useCard", "Generate welcome / goodbye card", data.useCard)}${page === "welcome" ? checkbox("dm", "Also send a DM", data.dm) : '<input type="hidden" name="dm" value="">'}<div class="form-row">${field("buttonLabel", "Link button label", data.buttonLabel)}${field("buttonUrl", "Link destination (HTTPS)", data.buttonUrl, "url")}</div>${saveFooter()}</form><div><div class="preview"><div class="preview-head"><span class="brandmark">z</span><strong>Zeechei</strong><small>APP</small><span class="muted">Today</span></div><p id="preview-message" class="preview-message"></p><div class="preview-embed"><h3 id="preview-title"></h3><p id="preview-description"></p><img id="preview-image" alt="Banner preview" hidden></div><button id="preview-button" type="button" disabled hidden></button></div><p class="variables">TEMPLATE VARIABLES<br>{user} · {username} · {displayName} · {server}<br>{memberCount} · {userId} · {serverId} · {createdAt}<br><br>Preview uses sample member data. Generated cards and avatars appear in Discord.</p></div></div>`;
    const getValues = (form) =>
        Object.fromEntries(
            Object.keys(data).map((key) => [
                key,
                ["enabled", "thumbnail", "useCard", "dm"].includes(key)
                    ? Boolean(form.elements[key]?.checked)
                    : form.elements[key]?.value || "",
            ]),
        );
    wireForm((form) => ({ [page]: getValues(form) }));
    const preview = () => {
        const values = getValues($("#settings-form"));
        const variables = {
            user: "@new-member",
            username: "new-member",
            displayName: "New Member",
            server: overview.name,
            memberCount: String(overview.members),
            userId: "123456789012345678",
            serverId: guildId,
            createdAt: "2026-01-01",
        };
        const expand = (text) => text.replace(/\{(\w+)\}/g, (all, key) => variables[key] ?? all);
        $("#preview-message").textContent = expand(values.message);
        $("#preview-title").textContent = expand(values.title);
        $("#preview-description").textContent = expand(values.description);
        $(".preview-embed").style.borderColor = values.color;
        $("#preview-image").hidden = !values.image.startsWith("https://");
        if (!$("#preview-image").hidden) $("#preview-image").src = values.image;
        $("#preview-button").hidden = !values.buttonLabel || !values.buttonUrl;
        $("#preview-button").textContent = values.buttonLabel;
    };
    $("#settings-form").addEventListener("input", preview);
    $("#settings-form").addEventListener("reset-preview", preview);
    preview();
}
function renderSettings() {
    const data = settings.data;
    $("#page").innerHTML =
        heading("Server settings", "Small adjustments. A better community experience.") +
        `<form id="settings-form" class="panel">${field("prefix", "Text command prefix", data.prefix || settings.defaults.prefix || "z")}<label class="field">Activity log channel<select name="logChannel">${channelOptions(data.logChannel)}</select></label><label class="field">Automatic join role<select name="autoRole"><option value="">No automatic role</option>${overview.roles.map((role) => `<option value="${role.id}" ${role.id === data.autoRole ? "selected" : ""}>${esc(role.name)}</option>`).join("")}</select></label>${checkbox("leveling", "Message XP and leveling", data.leveling)}${checkbox("musicMode247", "Keep music connected in 24/7 mode", data.musicMode247)}${saveFooter()}</form>`;
    wireForm((form) => ({
        prefix: form.elements.prefix.value,
        logChannel: form.elements.logChannel.value,
        autoRole: form.elements.autoRole.value,
        leveling: form.elements.leveling.checked,
        musicMode247: form.elements.musicMode247.checked,
    }));
}
function renderEmojis(data) {
    $("#page").innerHTML =
        heading(
            "Music emojis",
            "Use your own Discord emoji pack. Missing or restricted emojis fall back automatically.",
            "Owner",
        ) +
        `<form id="emoji-form" class="panel"><div class="form-row">${data.keys.map((key) => field(key, key[0].toUpperCase() + key.slice(1), data.values[key] || "")).join("")}</div><p class="muted">Paste custom emoji markup from Discord. Leave blank to use environment defaults or Unicode. Animated emojis take priority when available in the server.</p><div class="actions"><button type="button" id="clear-emojis">Use defaults</button><button class="primary" type="submit">Save emojis</button></div></form>`;
    const form = $("#emoji-form");
    form.oninput = () => {
        dirty = true;
    };
    $("#clear-emojis").onclick = () => {
        data.keys.forEach((key) => (form.elements[key].value = ""));
        dirty = true;
    };
    form.onsubmit = async (event) => {
        event.preventDefault();
        const button = form.querySelector("[type=submit]");
        button.disabled = true;
        try {
            await api("/owner/emojis", {
                method: "PATCH",
                body: JSON.stringify(
                    Object.fromEntries(data.keys.map((key) => [key, form.elements[key].value.trim()])),
                ),
            });
            dirty = false;
            toast("Music emoji preferences saved.");
        } catch (error) {
            toast(error.message);
        } finally {
            button.disabled = false;
        }
    };
}
function renderTickets() {
    const data = {
        categoryId: "",
        supportRoleIds: [],
        transcriptChannelId: "",
        autoCloseHours: 0,
        ...settings.data.ticket,
    };
    $("#page").innerHTML =
        heading("Tickets", "A private space for your community to get help.") +
        `<form id="settings-form" class="panel"><label class="field">Ticket category<select name="categoryId"><option value="">No category</option>${overview.categories.map((category) => `<option value="${category.id}" ${category.id === data.categoryId ? "selected" : ""}>${esc(category.name)}</option>`).join("")}</select></label><label class="field">Support roles (hold Ctrl / Command to select multiple)<select name="supportRoleIds" multiple>${overview.roles.map((role) => `<option value="${role.id}" ${data.supportRoleIds.includes(role.id) ? "selected" : ""}>${esc(role.name)}</option>`).join("")}</select></label><label class="field">Transcript log channel<select name="transcriptChannelId">${channelOptions(data.transcriptChannelId)}</select></label>${field("autoCloseHours", "Auto-close inactive tickets after hours (0 disables)", data.autoCloseHours, "number")}${saveFooter()}</form><section class="panel spaced"><h2>Ticket panel</h2><p class="sub">Publish a reusable panel in Discord. Members can open, claim, close, reopen, and export transcripts.</p><label class="field">Panel channel<select id="ticket-panel-channel">${channelOptions(settings.data.ticketPanel?.channelId)}</select></label><button id="publish-panel" class="primary">Publish panel</button></section>`;
    wireForm((form) => ({
        ticket: {
            categoryId: form.elements.categoryId.value,
            supportRoleIds: [...form.elements.supportRoleIds.selectedOptions].map((option) => option.value),
            transcriptChannelId: form.elements.transcriptChannelId.value,
            autoCloseHours: Number(form.elements.autoCloseHours.value),
        },
    }));
    $("#publish-panel").onclick = async (event) => {
        if (dirty) {
            toast("Save your ticket settings first.");
            return;
        }
        event.target.disabled = true;
        try {
            await api(`/guilds/${guildId}/tickets`, {
                method: "POST",
                body: JSON.stringify({ channelId: $("#ticket-panel-channel").value }),
            });
            toast("Ticket panel published.");
        } catch (error) {
            toast(error.message);
        } finally {
            event.target.disabled = false;
        }
    };
}
function renderAutoMod() {
    const data = {
        enabled: false,
        spam: false,
        links: false,
        invites: false,
        mentions: false,
        caps: false,
        duplicates: false,
        webhooks: false,
        badWords: [],
        maxMessages: 5,
        windowSeconds: 5,
        maxMentions: 5,
        capsPercent: 70,
        timeoutMinutes: 5,
        action: "delete",
        massJoin: false,
        antiRaid: false,
        joinThreshold: 10,
        joinWindowSeconds: 10,
        minAccountDays: 0,
        joinAction: "log",
        ...settings.data.automod,
    };
    const switches = [
        "enabled",
        "spam",
        "links",
        "invites",
        "mentions",
        "caps",
        "duplicates",
        "webhooks",
        "massJoin",
        "antiRaid",
    ];
    const labels = {
        enabled: "Enable AutoMod",
        spam: "Rapid message protection",
        links: "Block external links",
        invites: "Block Discord invites",
        mentions: "Mention protection",
        caps: "Excessive capital letters",
        duplicates: "Duplicate messages",
        webhooks: "Block webhook messages",
        massJoin: "Mass join detection",
        antiRaid: "Raid protection (5 minute window)",
    };
    const numbers = {
        maxMessages: "Messages per window",
        windowSeconds: "Message window (seconds)",
        maxMentions: "Maximum mentions",
        capsPercent: "Capital letters threshold (%)",
        timeoutMinutes: "Timeout duration (minutes)",
        joinThreshold: "Join threshold",
        joinWindowSeconds: "Join window (seconds)",
        minAccountDays: "Minimum account age (days; 0 disables)",
    };
    $("#page").innerHTML =
        heading("AutoMod", "Clear boundaries. A calmer community.") +
        `<form id="settings-form" class="panel"><div class="form-grid"><div>${switches.map((key) => checkbox(key, labels[key], data[key])).join("")}</div><div>${Object.entries(
            numbers,
        )
            .map(([key, label]) => field(key, label, data[key], "number"))
            .join(
                "",
            )}</div></div><label class="field">Blocked words (one per line)<textarea name="badWords">${esc(data.badWords.join("\n"))}</textarea></label><div class="form-row"><label class="field">Message action<select name="action"><option value="delete" ${data.action === "delete" ? "selected" : ""}>Delete message</option><option value="timeout" ${data.action === "timeout" ? "selected" : ""}>Delete and timeout</option></select></label><label class="field">Join protection action<select name="joinAction"><option value="log" ${data.joinAction === "log" ? "selected" : ""}>Log case only</option><option value="kick" ${data.joinAction === "kick" ? "selected" : ""}>Kick and log case</option></select></label></div>${checkbox("dmNotifications", "Send moderation case notifications by DM", settings.data.moderation?.dmNotifications)}${saveFooter()}</form>`;
    wireForm((form) => ({
        automod: {
            ...Object.fromEntries(switches.map((key) => [key, form.elements[key].checked])),
            ...Object.fromEntries(Object.keys(numbers).map((key) => [key, Number(form.elements[key].value)])),
            badWords: form.elements.badWords.value
                .split("\n")
                .map((word) => word.trim())
                .filter(Boolean),
            action: form.elements.action.value,
            joinAction: form.elements.joinAction.value,
        },
        moderation: { dmNotifications: form.elements.dmNotifications.checked },
    }));
}
window.addEventListener("beforeunload", (event) => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = "";
    }
});
$("#menu").onclick = () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menu").setAttribute("aria-expanded", String(open));
};
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        $("#sidebar").classList.remove("open");
        $("#menu").setAttribute("aria-expanded", "false");
    }
});
document
    .querySelectorAll("[data-page]")
    .forEach((button) => (button.onclick = () => navigate(button.dataset.page)));
$("#guild-select").onchange = (event) => chooseGuild(event.target.value);
$("#logout").onclick = async () => {
    if (!(await mayLeave())) return;
    try {
        await api("/auth/logout", { method: "POST" });
        dirty = false;
        location.reload();
    } catch (error) {
        toast(error.message);
    }
};
(async () => {
    try {
        const config = await api("/config");
        try {
            const identity = await api("/user");
            csrf = identity.csrf;
            $("#username").textContent = identity.user.username;
            $("#owner-nav").hidden = !identity.owner;
            $("#emoji-nav").hidden = !identity.owner;
        } catch (error) {
            if (error.status !== 401) throw error;
            $("#login").hidden = false;
            $(".skip").href = "#login-main";
            $("#login-status").textContent = config.setupRequired
                ? "Setup is incomplete. The server owner needs to finish configuration before Zeechei can go online."
                : config.oauthConfigured
                  ? "Only servers you manage are accessible."
                  : "Discord sign-in needs server configuration before it can be used.";
            if (!config.oauthConfigured) {
                $("#login-link").removeAttribute("href");
                $("#login-link").setAttribute("aria-disabled", "true");
            }
            return;
        }
        $("#shell").hidden = false;
        $("#connection").textContent = config.botOnline ? "Bot connected" : "Bot offline";
        guilds = await api("/guilds");
        $("#guild-select").innerHTML =
            '<option value="">My servers</option>' +
            guilds
                .filter((g) => g.installed)
                .map((g) => `<option value="${g.id}">${esc(g.name)}</option>`)
                .join("");
        renderGuilds();
    } catch (error) {
        $("#login").hidden = false;
        $(".skip").href = "#login-main";
        $("#login-status").textContent = error.message;
    }
})();
