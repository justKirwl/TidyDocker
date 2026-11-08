import { create, type StateCreator } from "zustand";
import { Container } from "../types";
import { useShallow } from "zustand/shallow";
import { produce } from "immer";

interface Actions {
    setContainers: (containers: Container[]) => void;
    clearContainers: () => void;
}

interface InitialState {
    containers: Container[]
}

interface ContainersState extends Actions, InitialState {}

const initialState: InitialState = {
    containers: []
}

const store: StateCreator<ContainersState> = ((set) => ({
    ...initialState,
    setContainers: (containers) => set(produce(state => {
        for (const container of containers) {
            const index = state.containers.findIndex(cont => cont.id === container.id);

            if (index !== -1) {
                state.containers[index] = {
                    ...state.containers[index],
                    ...container
                }
            }
            else {
                state.containers.push(container);
            }
        }
    })),
    clearContainers: () => set(state => ({ ...state, containers: [] }))
}))

const useContainersStore = create<ContainersState>()(store);

export const useContainersState = () => useContainersStore(useShallow(state => state.containers))

export const useContainersActions = () => useContainersStore(useShallow(state => ({
    setContainers: state.setContainers,
    clearContainers: state.clearContainers
})))