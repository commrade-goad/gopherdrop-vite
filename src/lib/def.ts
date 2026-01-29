export class User {
    public username: string = "";
    public public_key: string = "";
};

export interface WeirdUserWrapper {
    user: User;
};

export interface GFile {
	name: string,
	size: number,
	type: string,
}

export interface Transaction {
    id: string,
    sender: WeirdUserWrapper,
    files: GFile[],
    started: boolean,
}
