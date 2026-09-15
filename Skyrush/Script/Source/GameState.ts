namespace Script{
    import fc = FudgeCore;
    import fui = FudgeUserInterface;

    export class GameState extends fc.Mutable {
        protected reduceMutator(_mutator: fc.Mutator): void {}

        public height: string;
        public velocity: string; 
        private controller: fui.Controller;
        
        constructor (){ 
            super();    
            this.controller = new fui.Controller(this, document.querySelector("#vui"));
            console.log(this.controller);
        }
    }
}