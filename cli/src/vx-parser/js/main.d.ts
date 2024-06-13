interface RubyMap {
    display_name: string;
    events: RubyEvent[];
}

interface RubyEvent {
    pages: RubyPage[];
}

interface RubyPage {
    list: RubyList[];
}

interface RubyList {
    code: number;
    parameters: string[] | string;
}

interface RubyItem {
    name: string;
    note: string;
    description: string;
}

type Command = "dump" | "read" | "write";
