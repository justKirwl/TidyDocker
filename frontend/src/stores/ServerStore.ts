import { create, type StateCreator } from "zustand";
import { produce } from "immer";
import { useShallow } from "zustand/shallow";
import { LogLine } from "../types";

interface Actions {
    setLinkOk: (linkOk: boolean) => void;
    setServerLogs: (loglines: LogLine[]) => void;
    clearServerLogs: () => void;
}

interface InitialState {
    linkOk: boolean
    serverLogs: LogLine[]
}

interface ServerState extends Actions, InitialState {}

const initialState: InitialState = {
    linkOk: false,
    serverLogs: []
}

const store: StateCreator<ServerState> = ((set) => ({
    ...initialState,
    setLinkOk: (linkOk) => set(state => ({ ...state, linkOk: linkOk })),
    setServerLogs: (loglines) => set(state => ({ ...state, serverLogs: [...state.serverLogs, ...loglines] })),
    clearServerLogs: () => set(state => ({ ...state, serverLogs: [] }))
}))

const useServerStore = create<ServerState>()(store)

export const useServerStoreLogs = () => useServerStore(useShallow(state => state.serverLogs))

export const useServerInfo = () => useServerStore(useShallow(state => ({
    linkOk: state.linkOk
})))

export const useServerActions = () => useServerStore(useShallow(state => ({
    setLinkOk: state.setLinkOk,
    setServerLogs: state.setServerLogs,
    clearServerLogs: state.clearServerLogs
})))